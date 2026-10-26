"""Compara un Excel mensual de CoimpactoB con lo que quedó en el libro, miembro por miembro.

    python manage.py verificar_excel /tmp/shiliwai.xlsx

Por cada hoja (reunión) y cada asistente compara acciones, ahorro, fondo social y multas del
Excel contra los movimientos vigentes del libro. Termina con los totales y las diferencias; las
diferencias que el importe ya avisó (ahorro que no cuadra con las acciones) se marcan como tales.
"""

from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError

from acap.models import Acap, Membresia, Reunion
from libro.models import EstadoMovimiento, Movimiento
from migracion import excel

T = Movimiento.Tipo


class Command(BaseCommand):
    help = "Verifica que el libro coincide con el Excel importado."

    def add_arguments(self, parser):
        parser.add_argument("archivo")

    def handle(self, *args, **o):
        datos = excel.leer(o["archivo"])
        acap = Acap.objects.filter(nombre=datos.acap).first()
        if acap is None:
            raise CommandError(f"La ACAP «{datos.acap}» no está en la base.")
        numeros = dict(
            Membresia.objects.filter(acap=acap).values_list("titular_id", "numero_miembro")
        )
        self.stdout.write(
            f"ACAP {acap.nombre}: {len(numeros)} miembros en la base, "
            f"{len(datos.miembros)} en el Excel"
        )
        faltan = {m.numero for m in datos.miembros} - set(numeros.values())
        if faltan:
            self.stdout.write(self.style.ERROR(f"Miembros del Excel que faltan: {sorted(faltan)}"))

        diferencias, avisadas = [], 0
        tot_excel = defaultdict(int)
        tot_libro = defaultdict(int)
        for h in datos.hojas:
            reunion = Reunion.objects.filter(
                id=excel._id(acap.id, "reunion", h.fecha.isoformat())
            ).first()
            if reunion is None:
                diferencias.append(f"«{h.titulo}»: la reunión del {h.fecha} no está en la base")
                continue
            libro = defaultdict(lambda: defaultdict(int))
            movs = (
                Movimiento.objects.con_estado()
                .filter(reunion=reunion)
                .exclude(estado__in=[EstadoMovimiento.RECHAZADO, EstadoMovimiento.EN_CONFLICTO])
            )
            for m in movs:
                fila = libro[numeros.get(m.titular_id)]
                fila[m.tipo] += m.monto
                if m.tipo == T.AHORRO:
                    fila["acciones"] += m.detalle.get("acciones", 0)
            for f in h.filas:
                en_libro = libro.get(f.numero, {})
                esperado = {
                    "acciones": f.acciones,
                    T.AHORRO: f.acciones * reunion.valor_accion,
                    T.FONDO_SOCIAL: f.fondo_social,
                    T.MULTA: f.multa,
                }
                for clave, valor in esperado.items():
                    tot_excel[clave] += valor
                    tot_libro[clave] += en_libro.get(clave, 0)
                    if en_libro.get(clave, 0) != valor:
                        diferencias.append(
                            f"«{h.titulo}» miembro {f.numero} {clave}: Excel {valor:,} · "
                            f"libro {en_libro.get(clave, 0):,}"
                        )
                if f.ahorro != f.acciones * reunion.valor_accion:
                    avisadas += 1
            self.stdout.write(
                f"  {h.fecha} reunión {reunion.numero} (ciclo {reunion.ciclo.numero}): "
                f"{len(h.filas)} filas"
            )

        self.stdout.write("Totales (Excel -> libro):")
        for clave, texto in (
            ("acciones", "Acciones"),
            (T.AHORRO, "Ahorro"),
            (T.FONDO_SOCIAL, "Fondo social"),
            (T.MULTA, "Multas"),
        ):
            marca = "OK" if tot_excel[clave] == tot_libro[clave] else "DIFERENTE"
            self.stdout.write(f"  {texto}: {tot_excel[clave]:,} -> {tot_libro[clave]:,} {marca}")
        if avisadas:
            self.stdout.write(
                self.style.WARNING(
                    f"{avisadas} filas del Excel traen un ahorro en pesos que no cuadra con sus "
                    "acciones; el libro usa las acciones (el importe lo avisó)."
                )
            )
        if diferencias:
            self.stdout.write(self.style.ERROR(f"{len(diferencias)} diferencias:"))
            for d in diferencias:
                self.stdout.write(f"  {d}")
        else:
            self.stdout.write(self.style.SUCCESS("El libro coincide con el Excel."))
