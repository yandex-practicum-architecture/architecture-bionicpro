import express from 'express'; // Импортируем библиотеку Express для создания веб-сервера
import jwt from 'jsonwebtoken'; // Импортируем библиотеку для работы с JSON Web Tokens (JWT)
import jwksClient from 'jwks-rsa'; // Импортируем клиент JWKS для работы с JSON Web Key Set
import cors from 'cors'; // Импортируем библиотеку CORS для настройки междоменного доступа
import { faker } from '@faker-js/faker'; // Импортируем библиотеку Faker для генерации поддельных данных

const app = express(); // Создаем экземпляр приложения Express

// Настраиваем CORS для приложения
app.use(cors({
  origin: 'http://localhost:3000', // Разрешаем запросы только с указанного домена
  methods: ['GET', 'POST', 'OPTIONS'], // Разрешенные HTTP методы
  allowedHeaders: ['Content-Type', 'Authorization'], // Разрешенные заголовки для запросов
}));

app.use(express.json()); // Middleware для парсинга JSON тела запросов

// Логируем все входящие запросы
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`); // Выводим в консоль метод и URL запрашиваемого ресурса
  next(); // Передаем управление следующему middleware
});

// Конфигурация Keycloak
const keycloakRealm = 'reports-realm'; // Название реалма Keycloak
const keycloakUrl = 'http://keycloak:8080'; // URL Keycloak сервера
const issuerUrl = 'http://localhost:8080'; // URL издателя токена
const jwksUri = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/certs`; // URI для получения JWKS (набор ключей)

console.log(`JWKS URI: ${jwksUri}`); // Логируем JWKS URI

// Создаем клиент JWKS для получения открытых ключей
const client = jwksClient({
  jwksUri: jwksUri, // Указываем URI JWKS
});

// Функция для получения открытого ключа для верификации токена
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => { // Запрашиваем публичный ключ по его идентификатору (kid) из заголовка
    if (err) {
      console.error('Error fetching signing key:', err); // Логируем ошибку, если не удалось получить ключ
      callback(err, null); // Возвращаем ошибку в колбэке
    } else {
      const signingKey = key?.getPublicKey(); // Получаем открытый ключ
      callback(null, signingKey); // Передаем ключ в колбэк
    }
  });
}

// Функция для верификации токена
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization']; // Извлекаем заголовок авторизации из запроса
  if (!authHeader) {
    console.log('No Authorization header provided for', req.url); // Логируем отсутствие заголовка авторизации
    return res.status(401).json({ error: 'No token provided' }); // Возвращаем 401, если токен отсутствует
  }

  const token = authHeader.split(' ')[1]; // Извлекаем токен из заголовка авторизации
  if (!token) {
    console.log('Invalid token format for', req.url); // Логируем неправильный формат токена
    return res.status(401).json({ error: 'Invalid token format' }); // Возвращаем 401, если формат токена неверный
  }

  console.log('Token for', req.url, ':', token); // Логируем токен

  // Верифицируем токен
  jwt.verify(token, getKey, {
    issuer: `${issuerUrl}/realms/${keycloakRealm}`, // Указываем URL издателя токена
    algorithms: ['RS256'], // Алгоритм подписи токена
  }, (err, decoded) => { // Обрабатываем результат проверки токена
    if (err) {
      console.error('Token verification failed for', req.url, ':', err.message); // Логируем ошибку верификации
      return res.status(401).json({ error: 'Token verification failed', details: err.message }); // Возвращаем 401 при ошибке
    }

    // Если токен успешно проверен, сохраняем декодированные данные пользователя в req.user
    req.user = decoded; // Сохраняем декодированные данные о пользователе
    next(); // Переходим к следующему middleware
  });
};

// Функция для проверки роли
const checkRole = (req, res, next) => {
  // Проверяем наличие роли prothetic_user у пользователя
  if (!req.user.realm_access?.roles.includes('prothetic_user')) {
    console.log('User does not have required role for', req.url, ':', req.user.realm_access?.roles); // Логируем отсутствие роли
    return res.status(403).json({ error: 'Insufficient permissions', details: 'prothetic_user role required' }); // Возвращаем 403, если роль отсутствует
  }

  console.log('User has required role for', req.url); // Логируем, что у пользователя есть необходимая роль
  next(); // Переходим к следующему middleware
};

// Эндпоинт /reports с генерацией отчета для конкретного пользователя
app.get('/reports', verifyToken, checkRole, async (req, res) => {
  const user = req.user; // Извлекаем информацию о пользователе из запроса
  const userId = user.sub; // Получаем уникальный ID пользователя из токена

  // TODO: Заменить на реальные данные из ClickHouse и CRM
  const reportData = {
    reportId: faker.datatype.uuid(), // Генерируем случайный UUID для идентификации отчета
    userId: userId, // ID пользователя, для которого создается отчет
    username: user.preferred_username, // Имя пользователя, полученное из токена
    userEmail: user.email || 'N/A', // Email пользователя, если имеется, иначе 'N/A'
    userFullName: `${user.given_name || ''} ${user.family_name || ''}`.trim() || 'N/A', // Полное имя пользователя

    timestamp: new Date().toISOString(), // Временная метка отчета в формате ISO
    reportTitle: `Usage Report for ${user.preferred_username} - ${new Date().toLocaleDateString()}`, // Заголовок отчета с именем пользователя и текущей датой
    description: faker.lorem.sentence(), // Случайное описание отчета, сгенерированное с помощью Faker

    // Данные об использовании протеза
    steps: faker.datatype.number({ min: 1000, max: 10000 }), // Случайное количество шагов, которые пользователь сделал
    distanceTraveledKm: faker.datatype.float({ min: 0.5, max: 10, precision: 0.1 }), // Случайное расстояние, которое пользователь прошел в км
    activeTimeHours: faker.datatype.float({ min: 6, max: 18, precision: 0.5 }), // Случайное количество часов активного времени
    fallsDetected: faker.datatype.number({ min: 0, max: 3 }), // Количество падений, зафиксированных пользователем
    averageCadence: faker.datatype.number({ min: 60, max: 120 }), // Средняя частота шагов
    longestStrideLengthCm: faker.datatype.float({ min: 50, max: 100, precision: 1 }), // Длина самого длинного шага в сантиметрах
    batteryLevel: faker.datatype.number({ min: 20, max: 100 }), // Уровень заряда батареи устройства
    chargingCycles: faker.datatype.number({ min: 0, max: 500 }), // Количество циклов зарядки устройства

    // Данные о местоположении
    location: {
      latitude: Number(faker.address.latitude()), // Случайная широта
      longitude: Number(faker.address.longitude()), // Случайная долгота
    },
    lastKnownLocation: faker.address.city(), // Случайный город в качестве последнего известного местоположения

    // Диагностические данные
    diagnostics: {
      motorHealth: faker.helpers.arrayElement(['Good', 'Okay', 'Needs Service']), // Состояние мотора сгенерированное с помощью Faker
      sensorCalibration: faker.datatype.boolean(), // Состояние калибровки сенсоров (истина/ложь)
      powerConsumptionWatts: faker.datatype.float({ min: 5, max: 20, precision: 0.1 }), // Потребление энергии в ваттах
      temperatureCelsius: faker.datatype.float({ min: 25, max: 40, precision: 0.1 }), // Температура устройства в градусах Цельсия
      firmwareVersion: `v${faker.datatype.number({ min: 1, max: 5 })}.${faker.datatype.number({ min: 0, max: 9 })}.${faker.datatype.number({ min: 0, max: 9 })}`, // Версия прошивки
    },

    // Дополнительная информация
    additionalNotes: faker.lorem.sentence(), // Случайные дополнительные заметки о пользователе или устройстве
    status: faker.helpers.arrayElement(['Completed', 'In Progress', 'Pending']), // Случайный статус отчета
    dataOrigin: 'Faker Data (Placeholder)', // Указываем, что данные сгенерированы с помощью Faker

    legalDisclaimer: 'This report is for informational purposes only and does not constitute medical advice.', // Юридический отказ от ответственности
    reportGeneratedBy: 'Automated System', // Указываем, что отчет сгенерирован автоматически
    supportContact: 'support@bionicpro.com', // Контактная информация для поддержки
  };

  // TODO: Заменить на реальные данные из ClickHouse и CRM и добавить фильтрацию по userId
  res.json(reportData); // Отправляем сгенерированные данные отчета в формате JSON
});

// Запускаем сервер на порту 8000
app.listen(8000, () => console.log('Backend running on port 8000')); // Логируем запуск сервера
