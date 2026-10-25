# Dar de alta una ACAP para el piloto

Mientras llega la importación desde los Excel de CoimpactoB, una ACAP se crea a mano en la
oficina web. Se hace una vez por ACAP, y la persona necesita una cuenta de la Fundación con
permisos de Configuración.

Las direcciones de abajo son del piloto (`https://3-215-209-199.sslip.io`).

## 1. La ACAP y su ciclo (Configuración)

1. Abra **Configuración → ACAP → Agregar ACAP** y llene nombre, zona, departamento y municipio.
2. Abra **Configuración → Ciclos → Agregar ciclo** y llene estos campos:
   - la ACAP;
   - número;
   - fecha de inicio;
   - duración en meses;
   - valor de la acción;
   - máximo de acciones por reunión;
   - fondo social;
   - multa;
   - interés mensual (%);
   - estado **Activo**.

   Una ACAP tiene un solo ciclo activo.

## 2. Las personas (oficina → Personas)

Dé de alta a cada miembro con su número, nombre y consentimiento de datos (Ley 1581). El número
de miembro es el mismo del cuaderno.

## 3. Los cargos de la junta (Configuración → Ciclos → el ciclo)

En **Cargos**, agregue Presidente, Portador de Caja, Registrador, Contador 1 y Contador 2. Cada
uno se asigna a la membresía de la persona que lo tiene. Una persona tiene un solo cargo por ciclo.

## 4. El usuario de la app de la ACAP (Configuración → Usuarios → Agregar)

Llene estos campos:
- **usuario**: por ejemplo `shiliwai`;
- **clave**: con al menos 12 caracteres;
- **ACAP de la app**: la ACAP.

Este usuario solo sirve para registrar el celular de esa ACAP y no entra a la oficina web. Entregue
el usuario y la clave en persona, nunca por un grupo de mensajes.

## 5. En el celular de la junta (con señal, una sola vez)

1. Instale el APK del piloto (`docs/operacion/apk-piloto.md`).
2. Toque **Registrar este celular** y escriba el usuario y la clave. La app baja la lista del grupo.
3. La Presidenta o el Presidente crea su PIN de 6 números, dos veces.
4. Con su PIN, la Presidenta o el Presidente da de alta en ese mismo celular a los demás cargos.
   Cada cargo crea su propio PIN. Este paso funciona sin señal.

Desde ahí la reunión funciona sin señal. Cuando el celular vuelve a tener señal, lo registrado
sube al servidor y aparece en el panel de la Fundación.

## Si se pierde el celular

1. En **Configuración → Dispositivos**, use la acción **Retirar** sobre ese celular.
2. Cambie la clave del usuario de la ACAP.
3. Registre el celular nuevo con el paso 5.
