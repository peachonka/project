export interface Station {
    id: string
    name: string
    lat: number
    lng: number
    order: number
    line: {
      id: string
      hex_color: string
      name: string
    }
  }
  
  