from controllers.alerta_controller import ( 
    chequear_alertas_criticas,
    chequear_alertas_preventivas,
    chequear_alertas_informativas   
)
if __name__ == "__main__":
    print("Ejecutando análisis de alertas criticas...")
    chequear_alertas_criticas(),
    print("Ejecutando análisis de alertas criticas...")
    chequear_alertas_preventivas(),
    print("Ejecutando análisis de alertas criticas...")
    chequear_alertas_informativas()
    print("Análisis completo.")
