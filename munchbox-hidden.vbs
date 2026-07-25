' Launches the Munchbox supervisor with no console window at all.
' The startup launcher points at this so nothing flashes on screen at login.
Dim shell, here
Set shell = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & here & "\munchbox-daemon.ps1""", 0, False
