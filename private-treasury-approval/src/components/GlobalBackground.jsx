import React from "react";
import styled from "styled-components";

const BackgroundWrapper = styled.div`
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(30, 41, 246, 0.22), transparent 28%),
    radial-gradient(circle at top right, rgba(99, 102, 241, 0.16), transparent 20%),
    linear-gradient(180deg, #eff3ff 0%, #e2e8f0 100%);
`;

const ContentWrapper = styled.div`
  min-height: 100vh;
`;

export function GlobalBackground({ children }) {
  return (
    <BackgroundWrapper>
      <ContentWrapper>{children}</ContentWrapper>
    </BackgroundWrapper>
  );
}
