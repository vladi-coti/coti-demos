import React from "react";
import { ThemeProvider } from "styled-components";
import { light as theme } from "./config/theme";
import { GlobalBackground } from "./components/GlobalBackground";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalBackground>
        <HomePage />
      </GlobalBackground>
    </ThemeProvider>
  );
}

export default App;
