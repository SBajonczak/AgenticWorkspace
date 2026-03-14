'use client'

import { useTranslations } from 'next-intl'
import { Weather } from '@/mocks'
import { Sun, Cloud, CloudRain, Snowflake, Moon, CloudSun } from 'lucide-react'

interface WeatherIndicatorProps {
  weather: Weather
}

export default function WeatherIndicator({ weather }: WeatherIndicatorProps) {
  const t = useTranslations('common.weather.conditions')

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny':        return <Sun className="h-4 w-4" />
      case 'cloudy':       return <Cloud className="h-4 w-4" />
      case 'partly_cloudy': return <CloudSun className="h-4 w-4" />
      case 'rainy':        return <CloudRain className="h-4 w-4" />
      case 'snowy':        return <Snowflake className="h-4 w-4" />
      case 'clear':        return <Moon className="h-4 w-4" />
      default:             return <Sun className="h-4 w-4" />
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {getWeatherIcon(weather.condition)}
      <span>{weather.city}</span>
      <span className="text-border">·</span>
      <span className="font-semibold text-foreground">{weather.temperature}°{weather.unit}</span>
      <span className="text-border">·</span>
      <span>{t(weather.condition)}</span>
    </div>
  )
}
