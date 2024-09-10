import Hls from "hls.js";
import { getCachedVideo } from "./videoIndexedDB";
import { debounce, isNil } from "lodash";
import React, { useEffect } from "react";
import "./VideoPlayer.css";

export interface VideoPlayerProps {
  source: string;
  videoSrcChange?: () => void;
  onVideoReady?: (player: HTMLVideoElement) => void;
  className?: string;
  useCache?: boolean;
}
interface VideoInfo {
  videoKey: string;
  volume: number;
  isMute: boolean;
}

interface VideoSource {
  isCache: boolean;
  src: string;
}

const VideoPlayer = ({
  source,
  videoSrcChange,
  onVideoReady,
  className,
  useCache = false,
}: VideoPlayerProps) => {
  const cacheVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [videoCache, setVideoCache] = React.useState<VideoSource>();
  const [videoState, setVideoState] = React.useState<boolean>(false);
  const [playerState, setPlayerState] = React.useState<Hls>();

  useEffect(() => {
    const startWorker = async () => {
      const { default: VideoWorker } = await import("./videoWorker.ts?worker");
      const worker = new VideoWorker();
      worker.onmessage = (event) => {
        const { status, error } = event.data;
        if (status === "success") {
          console.log("Video saved to IndexedDB successfully.");
        } else {
          console.error("Error saving video to IndexedDB:", error);
        }
      };
      worker.postMessage({ url: source });
      return () => {
        worker.terminate();
      };
    };
    if (useCache) {
      startWorker();
    }
  }, [source, useCache]);

  //检查缓存是否有对应的视频，有就填入视频到video中
  useEffect(() => {
    if (source) {
      getCachedVideo(source + ".ts")
        .then((res) => {
          console.log("indexeddb cache res", res);
          if (res) {
            const tsUrlTemp = URL.createObjectURL(res);
            return tsUrlTemp;
          } else {
            setVideoCache({ isCache: false, src: source });
            return;
          }
        })
        .then(async (firstTsUrl) => {
          if (firstTsUrl) {
            const res = await fetch(source);
            const m3u8Text = await res.text();
            const lines = m3u8Text.split("\n");
            let newM3u8Content = "";
            let replaced = false;
            let hasChange = false;

            lines.forEach((line) => {
              // Replace the URL of the first TS segment after #EXTINF
              if (!replaced && line.startsWith("#EXTINF")) {
                newM3u8Content += `${line}\n`;
                newM3u8Content += `${firstTsUrl}\n`;
                replaced = true;
              } else if (replaced && !hasChange && line.endsWith("0000.ts")) {
                // Skip the original URL of the first TS segment
                replaced = true;
                hasChange = true;
              } else {
                newM3u8Content += `${line}\n`;
              }
            });
            console.log("New m3u8 have been generated!!!");
            const blob = new Blob([newM3u8Content], {
              type: "application/vnd.apple.mpegurl",
            });
            const newM3U8Url = URL.createObjectURL(blob);
            setVideoCache({ isCache: false, src: newM3U8Url });
          }
        })
        .catch(() => {
          setVideoCache({ isCache: false, src: source });
        });
    }
  }, [source]);

  useEffect(() => {
    const cacheVideo = cacheVideoRef.current;
    let cachePlayer: Hls | undefined;
    if (videoCache && cacheVideo) {
      cachePlayer = new Hls();
      cachePlayer.loadSource(videoCache.src);
      cachePlayer.attachMedia(cacheVideo);
      setPlayerState(cachePlayer);
      //获取修改的音量
      if (!isNil(localStorage.getItem("videos")) && Array.isArray(source)) {
        const videos = JSON.parse(
          localStorage.getItem("videos")!,
        ) as VideoInfo[];
        const currentVideo = videos.find((video) => video.videoKey === source);
        if (currentVideo) {
          cacheVideo.volume = currentVideo.volume;
          cacheVideo.muted = currentVideo.isMute;
        }
      }
      /**当在panel情况数据时就重置所有播放器的状态 */
      addEventListener("removeVideos", () => {
        //探测是否出现了video清空的事件，如果有就要将当前视频的音量设置为100%
        cacheVideo.volume = 1.0;
        cacheVideo.muted = false;
      });
      /**记录音量的修改 */
      cacheVideo.addEventListener(
        "volumechange",
        debounce(() => {
          if (cacheVideo) {
            const videoKey = source;
            const volume = cacheVideo.volume;
            const isMute = cacheVideo.muted;
            console.log(volume);

            if (!isNil(localStorage.getItem("videos"))) {
              //音量改变时记录音量到localStorage中
              const videos = JSON.parse(
                localStorage.getItem("videos")!,
              ) as VideoInfo[];

              //获取当前记录的volumes中和player src相同的视频
              const sameVideoIndex = videos.findIndex(
                (video) => video.videoKey === videoKey,
              );
              if (sameVideoIndex === -1) {
                //需要新建一项
                videos.push({
                  videoKey: videoKey,
                  volume: volume,
                  isMute: isMute,
                });
              } else {
                //修改原有音量数据
                videos[sameVideoIndex].volume = volume;
                videos[sameVideoIndex].isMute = isMute;
              }
              //将新的音量数据记录到localStorage中
              localStorage.setItem("videos", JSON.stringify(videos));
            } else {
              //当前没有videos的数据需要新建并写入
              const videos: VideoInfo[] = [
                {
                  videoKey: videoKey,
                  volume: volume,
                  isMute: isMute,
                },
              ];
              localStorage.setItem("videos", JSON.stringify(videos));
            }
          }
        }, 500),
      );
    }
  }, [videoCache]);

  //换源后重新播放视频
  useEffect(() => {
    const cacheVideo = cacheVideoRef.current;
    if (videoSrcChange && videoState && playerState && cacheVideo) {
      console.log("change video source");
      playerState.on(Hls.Events.MANIFEST_PARSED, () => {
        cacheVideo.play();
      });
    }
    return () => {
      playerState?.off(Hls.Events.MANIFEST_PARSED, () => {});
      playerState?.destroy();
    };
  }, [playerState, videoSrcChange]);

  /**播放结束后切换视频源 */

  useEffect(() => {
    const cacheVideo = cacheVideoRef.current;
    if (cacheVideo) {
      cacheVideo.addEventListener("ended", () => {
        if (videoSrcChange) {
          //视频播放结束
          videoSrcChange(); //修改了播放的路径
        }
      });
    }
    return () => {
      if (cacheVideo) {
        cacheVideo.removeEventListener("ended", () => {});
      }
    };
  }, [videoSrcChange]);

  /**确保宽屏模式下只有一个播放器生效 */
  useEffect(() => {
    const cacheVideo = cacheVideoRef.current;
    if (cacheVideo) {
      cacheVideo.addEventListener("play", () => {
        onVideoReady && onVideoReady(cacheVideo);
      });
    }
  }, [onVideoReady]);

  return (
    <video
      className={className}
      ref={cacheVideoRef}
      controls
      onCanPlayThrough={() => {
        setVideoState(true);
      }}
    ></video>
  );
};

export default VideoPlayer;
