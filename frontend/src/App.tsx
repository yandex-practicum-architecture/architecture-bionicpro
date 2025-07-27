import React from 'react'; // Импортируем библиотеку React
import { ReactKeycloakProvider } from '@react-keycloak/web'; // Импортируем провайдер для интеграции Keycloak с React
import Keycloak, { KeycloakConfig } from 'keycloak-js'; // Импортируем библиотеку Keycloak для работы с аутентификацией
import ReportPage from './components/ReportPage'; // Импортируем компонент страницы отчета

// Конфигурация Keycloak
const keycloakConfig: KeycloakConfig = {
  url: process.env.REACT_APP_KEYCLOAK_URL, // URL Keycloak сервера, берем из переменной окружения
  realm: process.env.REACT_APP_KEYCLOAK_REALM || "", // Название реалма, берем из переменной окружения
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID || "", // Идентификатор клиента, берем из переменной окружения
};

// Создаем экземпляр Keycloak с конфигурацией
const keycloak = new Keycloak(keycloakConfig);

// Главный компонент приложения
const App: React.FC = () => {
  return (
    <ReactKeycloakProvider
      authClient={keycloak} // Передаем клиент Keycloak в провайдер
      initOptions={{
        onLoad: 'login-required', // Указываем, что пользователь должен быть залогинен для доступа к приложению
        pkceMethod: 'S256', // Включаем PKCE (Proof Key for Code Exchange) с методом S256 для повышения безопасности
      }}
    >
      <div className="App">
        <ReportPage /> {/* Рендерим компонент страницы отчета */}
      </div>
    </ReactKeycloakProvider>
  );
};

export default App; // Экспортируем главный компонент приложения
