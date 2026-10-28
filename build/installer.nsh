!macro customInstall
  ExecWait 'netsh advfirewall firewall add rule name="MiTienda LAN TCP" dir=in action=allow protocol=TCP localport=4000,4001 profile=any'
  ExecWait 'netsh advfirewall firewall add rule name="MiTienda LAN UDP" dir=in action=allow protocol=UDP localport=41234 profile=any'
!macroend

!macro customUnInstall
  ExecWait 'netsh advfirewall firewall delete rule name="MiTienda LAN TCP"'
  ExecWait 'netsh advfirewall firewall delete rule name="MiTienda LAN UDP"'
!macroend