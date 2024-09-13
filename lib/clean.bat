@echo off

set "target_folder=node_modules"
set "inner_target_folder=frontend\node_modules"

if exist "%target_folder%" (
    echo Deleting folder: %target_folder%
    rmdir /s /q "%target_folder%"
) else (
    echo Folder does not exist: %target_folder%
)

if exist "%inner_target_folder%" (
    echo Deleting folder: %inner_target_folder%
    rmdir /s /q "%inner_target_folder%"
) else (
    echo Folder does not exist: %inner_target_folder%
)