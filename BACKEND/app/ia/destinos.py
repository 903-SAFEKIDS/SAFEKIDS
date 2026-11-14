from datetime import datetime

from app.ia.tiempo import dia_semana, minuto_del_dia


def probabilidad_destinos(
    visitas: list[dict],
    lugares: list[dict],
    ahora: datetime,
    ultimo_lugar_id: int | None = None,
    ventana_min: int = 120,
    suavizado: float = 0.5,
) -> list[dict]:
    """Probabilidad de que cada lugar frecuente sea el próximo destino del menor.

    Cuenta, en el historial, cuántas veces llegó a cada lugar el mismo día de la semana
    en la ventana [ahora, ahora + ventana_min]. El lugar donde estaba por última vez se
    descarta (ya salió de ahí). El suavizado evita probabilidades de 0 por falta de datos.
    """
    inicio = minuto_del_dia(ahora)
    fin = inicio + ventana_min
    dia = dia_semana(ahora)

    candidatos = [l for l in lugares if l["id"] != ultimo_lugar_id]
    if not candidatos:
        return []

    llegadas = {l["id"]: 0 for l in candidatos}
    for v in visitas:
        if v["lugar_id"] not in llegadas or dia_semana(v["llegada"]) != dia:
            continue
        minuto = minuto_del_dia(v["llegada"])
        if inicio <= minuto < fin or inicio <= minuto + 1440 < fin:  # la ventana puede cruzar la medianoche
            llegadas[v["lugar_id"]] += 1

    total = sum(llegadas.values()) + suavizado * len(candidatos)
    resultado = [
        {
            "lugar_id": l["id"],
            "nombre": l["nombre"],
            "lat": l["lat"],
            "lng": l["lng"],
            "probabilidad": round((llegadas[l["id"]] + suavizado) / total, 3),
            "llegadas_observadas": llegadas[l["id"]],
        }
        for l in candidatos
    ]
    return sorted(resultado, key=lambda r: r["probabilidad"], reverse=True)