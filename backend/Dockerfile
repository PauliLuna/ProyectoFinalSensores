# Usa una imagen base oficial de Python.
# '3.10-slim' es una buena opción, ya que es ligera.
FROM python:3.10-slim

# Establece el directorio de trabajo dentro del contenedor.
# Aquí es donde se copiará y ejecutará tu código.
WORKDIR /app

# Copia el archivo requirements.txt primero.
# Esto permite que Docker use el caché de la capa si las dependencias no cambian.
COPY requirements.txt .

# Instala todas las dependencias.
# '--no-cache-dir' reduce el tamaño de la imagen final.
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto de los archivos de tu proyecto al directorio de trabajo.
COPY . .

# Expone el puerto que usará tu aplicación.
# En este caso, el puerto 80 es un puerto web estándar.
EXPOSE 80

# Comando para ejecutar la aplicación.
# Por ejemplo, para una aplicación Flask llamada `app.py`:
CMD ["gunicorn", "--bind", "0.0.0.0:80", "app:app"]