' QuizZy Silent Background Launcher
' Double-clicking this launches the QuizZy supervisor completely invisible with zero terminal pop-ups.
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
hiddenVbs = fso.BuildPath(scriptDir, "scripts\launch_backend_hidden.vbs")
WshShell.Run "wscript.exe """ & hiddenVbs & """", 0, False
Set WshShell = Nothing
Set fso = Nothing
