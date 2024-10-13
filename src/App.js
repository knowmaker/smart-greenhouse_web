import './App.css'; // Импортируем стили
import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';

const App = () => {
  const [sensorData, setSensorData] = useState({
    waterT: 0,
    airT: 0,
    airH: 0,
    soilM1: 0,
    soilM2: 0,
    light: 0,
  });

  const [deviceStates, setDeviceStates] = useState({
    lighting: false,
    ventilation: false,
    watering1: false,
    watering2: false,
  });

  // Используем useRef для хранения MQTT клиента
  const clientRef = useRef(null);

  // Инициализация подключения к MQTT
  useEffect(() => {
    const clientId = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    const host = 'ws://broker.emqx.io:8083/mqtt';

    const options = {
      keepalive: 60,
      clientId: clientId,
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      will: {
        topic: 'WillMsg',
        payload: 'Connection Closed abnormally..!',
        qos: 0,
        retain: false,
      },
    };

    console.log('Connecting MQTT client');
    clientRef.current = mqtt.connect(host, options);

    // Устанавливаем коллбэки
    clientRef.current.on('connect', () => {
      console.log('Connected to MQTT broker');

      // Подписка на топики
      clientRef.current.subscribe('base/data');  // Топик для получения данных от сенсоров
      clientRef.current.subscribe('base/control/#'); // Подписка на все топики управления

      refreshData();
    });

    clientRef.current.on('message', (topic, message) => {
      console.log('Received message:', topic, message.toString());

      // Обновление данных датчиков и состояния устройств в зависимости от полученного топика
      if (topic === 'base/data') {
        const data = JSON.parse(message.toString());
        setSensorData({
          waterT: data.waterT,
          airT: data.airT,
          airH: data.airH,
          soilM1: data.soilM1,
          soilM2: data.soilM2,
          light: data.light,
        });

        // Обновляем состояние устройств на основе данных
        setDeviceStates({
          lighting: data.lState === 1,
          ventilation: data.vState === 1,
          watering1: data.wState1 === 1,
          watering2: data.wState2 === 1,
        });
      }
    });

    clientRef.current.on('error', (error) => {
      console.log('MQTT Connection Error: ', error);
      clientRef.current.end();
    });

    clientRef.current.on('reconnect', () => {
      console.log('Reconnecting...');
    });

    // Завершаем подключение при размонтировании компонента
    return () => {
      clientRef.current.end();
    };
  }, []);

  // Функция для отправки команды на управление устройствами
  const toggleDevice = (device) => {
    const newState = !deviceStates[device];
    setDeviceStates((prevStates) => ({
      ...prevStates,
      [device]: newState,
    }));

    const topic = `base/control/${device}`;
    const state = newState ? 1 : 0;
    console.log(`MQTT: ${topic} -> ${state}`);

    // Публикация команды на включение/выключение устройства
    if (clientRef.current) {
      clientRef.current.publish(topic, state.toString());
    }
  };

  const refreshData = () => {
    // Запрос на обновление данных
    console.log('MQTT: base/poll/request');
    if (clientRef.current) {
      clientRef.current.publish('base/poll/request', ''); // Публикация запроса на обновление данных
    }
  };

  return (
    <div>
      <h1 className="header">Умная Теплица — Контроль и Управление</h1>

      {/* Секция с датчиками */}
      <section id="sensors">
        <div className="section-header">Мониторинг состояния</div>
        <button className="refresh-btn" onClick={refreshData}>Обновить данные</button>
        <div className="grid-container">
          <SensorCard label="Температура воды" value={sensorData.waterT} unit="°C" />
          <SensorCard label="Температура воздуха" value={sensorData.airT} unit="°C" />
          <SensorCard label="Влажность воздуха" value={sensorData.airH} unit="%" />
          <SensorCard label="Влажность почвы 1" value={sensorData.soilM1} unit="%" />
          <SensorCard label="Влажность почвы 2" value={sensorData.soilM2} unit="%" />
          <SensorCard label="Освещённость" value={sensorData.light} unit="%" />
        </div>
      </section>

      {/* Секция управления */}
      <section id="controls">
        <div className="section-header">Управление устройствами</div>
        <div className="grid-container">
          <ControlCard
            label="Освещение"
            state={deviceStates.lighting}
            toggle={() => toggleDevice('lighting')}
          />
          <ControlCard
            label="Вентиляция"
            state={deviceStates.ventilation}
            toggle={() => toggleDevice('ventilation')}
          />
          <ControlCard
            label="Полив 1"
            state={deviceStates.watering1}
            toggle={() => toggleDevice('watering1')}
          />
          <ControlCard
            label="Полив 2"
            state={deviceStates.watering2}
            toggle={() => toggleDevice('watering2')}
          />
        </div>
      </section>
    </div>
  );
};

// Компонент для отображения данных датчиков
const SensorCard = ({ label, value, unit }) => {
  // Определяем смайл для освещенности
  const getLightEmoji = (lightValue) => {
    return lightValue === 0 ? '☀️' : '🌑';
  };

  return (
    <div className="card sensor-card">
      <div>{label}</div>
      {label === "Освещённость" ? (
        <div className="sensor-value">{getLightEmoji(value)}</div>
      ) : (
        <>
          <div className="sensor-value">{value} {unit}</div>
          <div className="scale" style={{ background: `linear-gradient(to right, #caf9d2, #FF5733 ${value}%, transparent ${value}%)` }}></div>
        </>
      )}
    </div>
  );
};



// Компонент для управления устройствами
const ControlCard = ({ label, state, toggle }) => {
  return (
    <div className="control-card">
      <div className="control-title">{label}</div>
      <label className="toggle-switch">
        <input type="checkbox" checked={state} onChange={toggle} />
        <span className="slider"></span>
      </label>
    </div>
  );
};

export default App;
