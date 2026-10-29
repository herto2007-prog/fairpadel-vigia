# fairpadel-vigia

Vigilante de [FairPadel](https://www.fairpadel.com): cada 5 minutos revisa que la web y
el servidor respondan, y avisa por WhatsApp al administrador cuando se cae y cuando
vuelve.

No contiene código de FairPadel ni ninguna clave: las credenciales de WhatsApp viven en
los *secrets* del repositorio (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`AVISO_WHATSAPP`).

- `vigilar.yml` — el chequeo (tres intentos antes de declarar una caída; avisa sólo en
  los cambios de estado). Se puede correr a mano con "probar aviso = sí".
- `latido.yml` — un commit mensual para que GitHub no apague el vigilante por
  inactividad.
