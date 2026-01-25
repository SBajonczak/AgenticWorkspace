'use client'

import { useTranslations } from 'next-intl'
import { Weather } from '@/mocks'

interface WeatherIndicatorProps {
  weather: Weather
}

export default function WeatherIndicator({ weather }: WeatherIndicatorProps) {
  const t = useTranslations('common.weather.conditions')
  
  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny':
        return '☀️'
      case 'cloudy':
      case 'partly_cloudy':
        return '☁️'
      case 'rainy':
        return '🌧️'
      case 'snowy':
        return '❄️'
      case 'clear':
        return '🌙'
      default:
        return '🌤️'
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-300">
      <span>{getWeatherIcon(weather.condition)}</span>
      <span>{weather.city}</span>
      <span className="text-gray-500">·</span>
      <span className="font-semibold">{weather.temperature}°{weather.unit}</span>
      <span className="text-gray-500">·</span>
      <span>{t(weather.condition)}</span>
    </div>
  )
}
