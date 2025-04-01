import json
import os

# Словарь для преобразования названий линий в индексы
LINE_NAME_TO_INDEX = {
    "Сокольническая": "1",
    "Замоскворецкая": "2",
    "Арбатско-Покровская": "3",
    "Филевская": "4",
    "Кольцевая": "5",
    "Калужско-Рижская": "6",
    "Таганско-Краснопресненская": "7",
    "Калининская": "8",
    "Серпуховско-Тимирязевская": "9",
    "Люблинско-Дмитровская": "10",
    "Каховская": "11",
    "Бутовская": "12",
    "Солнцевская": "8A",
    "МЦК": "14",
    "Монорельс": "13",
    "Большая кольцевая линия": "11A",
    "Некрасовская": "15",
    "МЦД-1": "D1",
    "МЦД-2": "D2",
    "МЦД-3": "D3",
    "МЦД-4": "D4",
    "Троицкая": "16"
}

def add_line_indices(input_file, output_file):
    """Добавляет индексы линий метро в данные и сохраняет в новый файл"""
    
    # Читаем данные из входного файла
    with open(input_file, 'r', encoding='utf-8') as f:
        metro_data = json.load(f)
    
    # Обходим все линии и станции
    for line in metro_data["lines"]:
        line_name = line["name"]
        if line_name in LINE_NAME_TO_INDEX:
            index = LINE_NAME_TO_INDEX[line_name]
            line["index"] = index
            
            # Обновляем индекс для всех станций на этой линии
            for station in line["stations"]:
                station["line"]["index"] = index
    
    # Сохраняем обновленные данные в выходной файл
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(metro_data, f, ensure_ascii=False, indent=2)
    
    print(f"Данные успешно обработаны и сохранены в {output_file}")

# Пример использования
if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Формируем полные пути к файлам
    input_json = os.path.join(script_dir, "stations.json")
    output_json = os.path.join(script_dir, "stations_with_indexes.json")
    add_line_indices(input_json, output_json)