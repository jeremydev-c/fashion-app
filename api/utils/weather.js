/**
 * Weather service using OpenWeatherMap API
 * Get current weather based on location
 */

/**
 * Get current weather for a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
async function getCurrentWeather(lat, lon) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENWEATHER_API_KEY is not configured');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert temperature to weather category
    const temp = data.main.temp;
    let weatherCategory = 'warm';
    
    if (temp < 0) {
      weatherCategory = 'cold';
    } else if (temp < 10) {
      weatherCategory = 'cool';
    } else if (temp < 25) {
      weatherCategory = 'warm';
    } else {
      weatherCategory = 'hot';
    }

    return {
      temperature: Math.round(temp),
      condition: data.weather[0].main.toLowerCase(), // rain, snow, clear, clouds, etc.
      description: data.weather[0].description,
      weatherCategory, // hot, warm, cool, cold
      humidity: data.main.humidity,
      windSpeed: data.wind?.speed || 0,
      city: data.name,
      country: data.sys?.country || '',
    };
  } catch (error) {
    console.error('Weather API error:', error);
    throw new Error(`Failed to get weather: ${error.message}`);
  }
}

/**
 * Get weather by city name
 * @param {string} cityName - City name
 * @returns {Promise<Object>} Weather data
 */
async function getWeatherByCity(cityName) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENWEATHER_API_KEY is not configured');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${apiKey}&units=metric`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert temperature to weather category
    const temp = data.main.temp;
    let weatherCategory = 'warm';
    
    if (temp < 0) {
      weatherCategory = 'cold';
    } else if (temp < 10) {
      weatherCategory = 'cool';
    } else if (temp < 25) {
      weatherCategory = 'warm';
    } else {
      weatherCategory = 'hot';
    }

    return {
      temperature: Math.round(temp),
      condition: data.weather[0].main.toLowerCase(),
      description: data.weather[0].description,
      weatherCategory,
      humidity: data.main.humidity,
      windSpeed: data.wind?.speed || 0,
      city: data.name,
      country: data.sys?.country || '',
      lat: data.coord.lat,
      lon: data.coord.lon,
    };
  } catch (error) {
    console.error('Weather API error:', error);
    throw new Error(`Failed to get weather: ${error.message}`);
  }
}

/**
 * Get weather forecast for a city (next 24 hours broken into periods)
 * @param {string} cityName - City name
 * @returns {Promise<Object>} Forecast data with morning, afternoon, evening
 */
async function getWeatherForecast(cityName) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENWEATHER_API_KEY is not configured');
    }

    // First get coordinates for the city
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${apiKey}`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    if (!geoData || geoData.length === 0) {
      throw new Error('City not found');
    }

    const { lat, lon, name, country } = geoData[0];

    // Get 5-day/3-hour forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const forecastResponse = await fetch(forecastUrl);

    if (!forecastResponse.ok) {
      throw new Error(`Forecast API error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();

    // Get today's and tomorrow's forecasts
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // Process forecast into time periods
    const periods = {
      morning: [], // 6am - 12pm
      afternoon: [], // 12pm - 6pm
      evening: [], // 6pm - 12am
      night: [], // 12am - 6am
    };

    // Get forecasts for today and tomorrow
    forecastData.list.forEach((item) => {
      const itemDate = item.dt_txt.split(' ')[0];
      const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0]);

      if (itemDate === todayDate || itemDate === tomorrowDate) {
        const periodData = {
          temp: Math.round(item.main.temp),
          condition: item.weather[0].main.toLowerCase(),
          description: item.weather[0].description,
          humidity: item.main.humidity,
          windSpeed: item.wind?.speed || 0,
          time: item.dt_txt,
          pop: Math.round((item.pop || 0) * 100), // Probability of precipitation
        };

        if (hour >= 6 && hour < 12) {
          periods.morning.push(periodData);
        } else if (hour >= 12 && hour < 18) {
          periods.afternoon.push(periodData);
        } else if (hour >= 18 && hour < 24) {
          periods.evening.push(periodData);
        } else {
          periods.night.push(periodData);
        }
      }
    });

    // Calculate summary for each period
    const summarizePeriod = (data) => {
      if (data.length === 0) return null;

      const temps = data.map((d) => d.temp);
      const minTemp = Math.min(...temps);
      const maxTemp = Math.max(...temps);
      const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);

      // Most common condition
      const conditions = data.map((d) => d.condition);
      const conditionCounts = {};
      conditions.forEach((c) => {
        conditionCounts[c] = (conditionCounts[c] || 0) + 1;
      });
      const mainCondition = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0][0];

      // Max rain chance
      const maxRainChance = Math.max(...data.map((d) => d.pop));

      // Weather category based on average temp
      let weatherCategory = 'warm';
      if (avgTemp < 0) weatherCategory = 'cold';
      else if (avgTemp < 10) weatherCategory = 'cool';
      else if (avgTemp < 25) weatherCategory = 'warm';
      else weatherCategory = 'hot';

      return {
        minTemp,
        maxTemp,
        avgTemp,
        condition: mainCondition,
        weatherCategory,
        rainChance: maxRainChance,
      };
    };

    const morning = summarizePeriod(periods.morning);
    const afternoon = summarizePeriod(periods.afternoon);
    const evening = summarizePeriod(periods.evening);

    // Overall summary for the day
    const allTemps = [
      ...(morning ? [morning.minTemp, morning.maxTemp] : []),
      ...(afternoon ? [afternoon.minTemp, afternoon.maxTemp] : []),
      ...(evening ? [evening.minTemp, evening.maxTemp] : []),
    ];

    const overallMin = allTemps.length > 0 ? Math.min(...allTemps) : null;
    const overallMax = allTemps.length > 0 ? Math.max(...allTemps) : null;
    const tempSwing = overallMax - overallMin;

    // Determine if layers are needed
    const needsLayers = tempSwing > 8; // More than 8°C difference
    const hasRainRisk = [morning, afternoon, evening].some((p) => p && p.rainChance > 30);

    // Smart recommendation
    let recommendation = '';
    if (needsLayers && hasRainRisk) {
      recommendation = 'Pack layers and bring rain protection — temperature varies and rain is possible.';
    } else if (needsLayers) {
      recommendation = 'Pack layers — temperature varies throughout the day.';
    } else if (hasRainRisk) {
      recommendation = 'Bring rain protection — precipitation is likely.';
    } else {
      recommendation = 'Consistent weather expected — dress for the temperature range.';
    }

    // Determine overall weather category (use the warmest period for outfit planning)
    const categories = [morning, afternoon, evening]
      .filter(Boolean)
      .map((p) => p.weatherCategory);
    
    const categoryPriority = { hot: 4, warm: 3, cool: 2, cold: 1 };
    const dominantCategory = categories.sort(
      (a, b) => categoryPriority[b] - categoryPriority[a]
    )[0] || 'warm';

    return {
      city: name,
      country,
      lat,
      lon,
      periods: {
        morning,
        afternoon,
        evening,
      },
      summary: {
        minTemp: overallMin,
        maxTemp: overallMax,
        tempSwing,
        needsLayers,
        hasRainRisk,
        recommendation,
        weatherCategory: dominantCategory,
      },
    };
  } catch (error) {
    console.error('Forecast API error:', error);
    throw new Error(`Failed to get forecast: ${error.message}`);
  }
}

module.exports = {
  getCurrentWeather,
  getWeatherByCity,
  getWeatherForecast,
};

