"""Importa el Excel mensual de una ACAP (ver migracion/excel.py).

Sin --aplicar solo muestra lo que haría y los avisos. Ejemplo:

    python manage.py importar_excel /tmp/shiliwai.xlsx --usuario admin --zona Norte \
        --departamento "La Guajira" --municipio Riohacha --aplicar
"""

from django.core.management.base import BaseCommand, CommandError

from cuentas.models import Usuario
from migracion import excel


class Command(BaseCommand):
    help = "Importa el Excel mensual de una ACAP (miembros, reuniones, ahorro, fondo y multas)."

    def add_arguments(self, parser):
        parser.add_argument("archivo")
        parser.add_argument("--usuario", required=True, help="Quién importa.")
        parser.add_argument("--duracion", type=int, help="Meses del ciclo.")
        parser.add_argument("--primer-ciclo", type=int, default=1)
        parser.add_argument("--zona", default="")
        parser.add_argument("--departamento", default="")
        parser.add_argument("--municipio", default="")
        parser.add_argument("--aplicar", action="store_true", help="Escribir en la base.")

    def handle(self, *args, **o):
        try:
            usuario = Usuario.objects.get(username=o["usuario"])
        except Usuario.DoesNotExist as error:
            raise CommandError(f"No existe el usuario {o['usuario']}.") from error
        datos = excel.leer(o["archivo"], duracion_meses=o["duracion"])
        self.stdout.write(f"ACAP: {datos.acap}")
        self.stdout.write(
            f"Reglamento: acción ${datos.valor_accion:,} · fondo ${datos.valor_fondo_social:,} · "
            f"multa ${datos.valor_multa:,} · interés {datos.tasa_interes} % · "
            f"{datos.duracion_meses} meses desde {datos.fecha_inicio}"
        )
        cargos = sum(1 for m in datos.miembros if m.cargo)
        self.stdout.write(f"Miembros: {len(datos.miembros)} ({cargos} con cargo de junta)")
        for c in excel.ciclos_de(datos, o["primer_ciclo"]):
            self.stdout.write(f"Ciclo {c['numero']} (desde {c['inicio']}):")
            for h in c["hojas"]:
                ahorro = sum(f.acciones for f in h.filas) * datos.valor_accion
                fondo = sum(f.fondo_social for f in h.filas)
                multas = sum(f.multa for f in h.filas)
                self.stdout.write(
                    f"  {h.fecha} «{h.titulo}»: {len(h.filas)} filas · ahorro ${ahorro:,} · "
                    f"fondo ${fondo:,} · multas ${multas:,}"
                )
        for aviso in datos.avisos:
            self.stdout.write(self.style.WARNING(f"Aviso: {aviso}"))
        if not o["aplicar"]:
            self.stdout.write(self.style.NOTICE("Prueba: no se escribió nada (use --aplicar)."))
            return
        resultado = excel.aplicar(
            datos,
            usuario=usuario,
            primer_ciclo=o["primer_ciclo"],
            zona=o["zona"],
            departamento=o["departamento"],
            municipio=o["municipio"],
        )
        self.stdout.write(self.style.SUCCESS(f"Importado: {resultado}"))
