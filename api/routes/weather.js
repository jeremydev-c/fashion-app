const express = require('express');
const { getCurrentWeather, getWeatherByCity, getWeatherForecast } = require('../utils/weather');

const router = express.Router();

/**
 * GET /weather/current?lat=40.7128&lon=-74.0060
 * Get current weather by coordinates
 */
router.get('/current', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const weather = await getCurrentWeather(parseFloat(lat), parseFloat(lon));
    res.json({ weather });
  } catch (err) {
    console.error('GET /weather/current error', err);
    res.status(500).json({ error: err.message || 'Failed to get weather' });
  }
});

/**
 * GET /weather/city?city=London
 * Get current weather by city name
 */
router.get('/city', async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'city is required' });
    }

    const weather = await getWeatherByCity(city);
    res.json({ weather });
  } catch (err) {
    console.error('GET /weather/city error', err);
    res.status(500).json({ error: err.message || 'Failed to get weather' });
  }
});

/**
 * GET /weather/forecast?city=Mombasa
 * Get weather forecast for a city (morning, afternoon, evening)
 */
router.get('/forecast', async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'city is required' });
    }

    const forecast = await getWeatherForecast(city);
    res.json({ forecast });
  } catch (err) {
    console.error('GET /weather/forecast error', err);
    res.status(500).json({ error: err.message || 'Failed to get forecast' });
  }
});

module.exports = router;

