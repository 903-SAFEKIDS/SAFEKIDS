from datetime import datetime, timedelta, timezone

ZONA = timezone(timedelta(hours=-6))  # hora de la Ciudad de México (sin horario de verano)


def a_utc(dt: datetime) -> datetime:
    """Mongo guarda las fechas en UTC pero sin zona horaria: aquí se les agrega."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def a_local(dt: datetime) -> datetime:
    return a_utc(dt).astimezone(ZONA)


def minuto_del_dia(dt: datetime) -> int:
    local = a_local(dt)
    return local.hour * 60 + local.minute


def dia_semana(dt: datetime) -> int:
    """0 = lunes ... 6 = domingo, en hora local."""
    return a_local(dt).weekday()