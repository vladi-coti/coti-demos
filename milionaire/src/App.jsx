import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { GlobalBackground } from './components/GlobalBackground.jsx';
import { light as theme } from './config/theme.js';
import ChainSelectPage from './pages/ChainSelectPage.jsx';
import ExperienceCoti from './wrappers/ExperienceCoti.jsx';
import ExperiencePod from './wrappers/ExperiencePod.jsx';

function App() {
    return (
        <ThemeProvider theme={theme}>
            <GlobalBackground>
                <Router>
                    <Routes>
                        <Route path="/" element={<ChainSelectPage />} />
                        <Route path="/coti" element={<ExperienceCoti />} />
                        <Route path="/sepolia" element={<ExperiencePod networkId="sepolia" />} />
                        <Route path="/avalanche" element={<ExperiencePod networkId="avalanche" />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Router>
            </GlobalBackground>
        </ThemeProvider>
    );
}

export default App;
