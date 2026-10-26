// Registrar este celular (TD1, D18): entrar con el usuario y la clave que la Fundación creó para
// la ACAP, bajar la lista del grupo y crear el PIN del primer Presidente, dos veces y sin PIN
// obvios (D26). Con señal solo este paso; la reunión después funciona sin señal.

import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { programadorNativo } from "../avisos/programadorNativo";
import { SERVIDOR } from "../config";
import { borrarBase } from "../datos/baseNativa";
import { altaPrimerPresidente, presidenteDe, registrarConClave, revisarPinDoble, type EnrolamientoEnCurso } from "../enrolamiento/flujo";
import { nombreCargo } from "../seguridad/cargos";
import { EnrolamientoFallido } from "../seguridad/enrolamiento";
import { useSesion } from "../sesion/contexto";
import { Acciones, BotonPrincipal, BotonSecundario, CampoTexto, estilos as base, Estado, Nota, Parrafo, Titulo } from "../ui/componentes";
import { Campana, Celular, Listo } from "../ui/iconos";
import { c } from "../ui/tema";
import { TecladoPin } from "../ui/TecladoPin";

type Fase = "entrar" | "registrando" | "presidente" | "confirmar" | "guardando" | "listo";

export default function PantallaEnrolar() {
  const { entorno } = useSesion();
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("entrar");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string>();
  const [enCurso, setEnCurso] = useState<EnrolamientoEnCurso | null>(null);
  const [pin, setPin] = useState("");
  const [leyendo, setLeyendo] = useState(false);

  const deps = { ...entorno, servidor: SERVIDOR, borrarBase };

  const registrar = async () => {
    if (leyendo) return;
    setLeyendo(true);
    setError(undefined);
    setFase("registrando");
    try {
      setEnCurso(await registrarConClave(deps, usuario, clave));
      setClave("");
      setFase("presidente");
    } catch (e) {
      setError(e instanceof EnrolamientoFallido ? e.message : "No se pudo registrar este celular. Intente de nuevo.");
      setFase("entrar");
    } finally {
      setLeyendo(false);
    }
  };

  if (fase === "presidente" || fase === "confirmar" || fase === "guardando") {
    const presidente = enCurso ? presidenteDe(enCurso.foto) : null;
    return (
      <SafeAreaView style={base.pantalla}>
        <TecladoPin
          paraQuien={`${nombreCargo(enCurso?.foto.tipos_cargo ?? [], presidente?.tipo ?? "presidente")} · #${String(presidente?.numero ?? 0).padStart(2, "0")}`}
          aviso={fase === "presidente" ? (error ?? "Cree su PIN de 6 números.") : "Escriba el PIN otra vez."}
          guia={!(fase === "presidente" && error)}
          verificando={fase === "guardando"}
          alCompletar={async (escrito) => {
            if (fase === "presidente") {
              setPin(escrito);
              setError(undefined);
              setFase("confirmar");
              return;
            }
            const problema = revisarPinDoble(pin, escrito);
            if (problema) {
              setError(problema);
              setFase("presidente");
              return;
            }
            setFase("guardando");
            try {
              await altaPrimerPresidente(deps, enCurso!, pin);
              await enCurso!.base.cerrar();
              setFase("listo");
            } catch (e) {
              setError(e instanceof EnrolamientoFallido ? e.message : "No se pudo registrar el PIN. Intente de nuevo.");
              setFase(e instanceof EnrolamientoFallido && e.motivo === "codigo_invalido" ? "entrar" : "presidente");
            }
          }}
        />
      </SafeAreaView>
    );
  }

  if (fase === "listo") {
    return (
      <SafeAreaView style={base.pantalla}>
        <ScrollView contentContainerStyle={[base.contenido, { flexGrow: 1 }]}>
          <Estado titulo={`Celular registrado para ${enCurso?.registro.acapNombre ?? "la ACAP"}`} tono="bien" icono={<Listo size={38} color={c.bien} weight="duotone" />}>
            <Parrafo>Ya se puede abrir la reunión y dar de alta a los demás cargos de la junta.</Parrafo>
          </Estado>
          <View style={{ marginTop: 22, gap: 12 }}>
            <Parrafo tenue>Credimpacto puede avisarles el día antes de cada reunión. Los avisos nunca muestran plata ni nombres.</Parrafo>
            <BotonSecundario
              testID="activar-avisos"
              texto="Activar los avisos"
              icono={<Campana size={20} color={c.tinta} weight="bold" />}
              alTocar={() => void programadorNativo.pedirPermiso().catch(() => false)}
            />
          </View>
        </ScrollView>
        <Acciones>
          <BotonPrincipal testID="enrolar-listo" texto="Ir al inicio" alTocar={() => router.replace("/")} />
        </Acciones>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={base.pantalla}>
      <ScrollView contentContainerStyle={base.contenido} keyboardShouldPersistTaps="handled">
        {fase === "registrando" ? (
          <Estado titulo="Registrando este celular" trabajando icono={<Celular size={38} color={c.naranja} weight="duotone" />}>
            <Parrafo testID="enrolar-estado">Bajando la lista del grupo…</Parrafo>
          </Estado>
        ) : (
          <>
            <Titulo>Registrar este celular</Titulo>
            <Parrafo tenue>Escriba el usuario y la clave que le dio la Fundación para esta ACAP.</Parrafo>
            {error ? (
              <View style={{ marginTop: 14 }}>
                <Nota tono="mal" testID="enrolar-error">
                  {error}
                </Nota>
              </View>
            ) : null}
            <CampoTexto
              etiqueta="Usuario"
              testID="enrolar-usuario"
              value={usuario}
              onChangeText={setUsuario}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
            />
            <CampoTexto
              etiqueta="Clave"
              testID="enrolar-clave"
              value={clave}
              onChangeText={setClave}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              onSubmitEditing={() => usuario.trim() && clave && void registrar()}
            />
          </>
        )}
      </ScrollView>
      <Acciones>
        <BotonPrincipal
          testID="enrolar-entrar"
          texto="Registrar este celular"
          falta={fase === "registrando" ? "Registrando…" : usuario.trim() && clave ? undefined : "Escriba el usuario y la clave"}
          alTocar={() => void registrar()}
        />
      </Acciones>
    </SafeAreaView>
  );
}
