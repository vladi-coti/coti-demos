import styled from "styled-components";

export const AppContainer = styled.div`
  min-height: 100vh;
  padding: 32px 20px 56px;
  color: ${(props) => props.theme.colors.text.default};
`;

export const Section = styled.section`
  max-width: 1240px;
  margin: 0 auto;
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
  align-items: start;

  ${({ theme }) => theme.mediaQueries.large} {
    gap: 24px;
  }

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

export const Card = styled.div`
  grid-column: span ${(props) => props.$span || 12};
  background: ${(props) => props.theme.colors.card.default};
  border: 1px solid ${(props) => props.theme.colors.border.default};
  border-radius: 24px;
  box-shadow: ${(props) => props.theme.shadows.default};
  padding: 24px;
  backdrop-filter: blur(8px);

  ${({ theme }) => theme.mediaQueries.small} {
    grid-column: span 1;
    padding: 20px;
  }
`;

export const Title = styled.h1`
  margin: 0;
  font-size: 2rem;
  line-height: 1.15;
  color: ${(props) => props.theme.colors.text.default};
`;

export const Subtitle = styled.p`
  margin: 0;
  line-height: 1.6;
  color: ${(props) => props.theme.colors.text.muted};
`;

export const CardTitle = styled.h2`
  margin: 0 0 12px;
  font-size: 1.2rem;
  color: ${(props) => props.theme.colors.text.default};
`;

export const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  color: ${(props) => props.theme.colors.text.default};
`;

export const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid ${(props) => props.theme.colors.border.default};
  background: #fff;
  color: ${(props) => props.theme.colors.text.default};
  font-size: 0.95rem;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.primary.default};
    box-shadow: 0 0 0 3px rgba(30, 41, 246, 0.12);
  }
`;

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 92px;
  resize: vertical;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid ${(props) => props.theme.colors.border.default};
  background: #fff;
  color: ${(props) => props.theme.colors.text.default};
  font-size: 0.95rem;
  line-height: 1.5;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.primary.default};
    box-shadow: 0 0 0 3px rgba(30, 41, 246, 0.12);
  }
`;

export const Select = styled.select`
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid ${(props) => props.theme.colors.border.default};
  background: #fff;
  color: ${(props) => props.theme.colors.text.default};
  font-size: 0.95rem;
`;

export const Field = styled.div`
  margin-bottom: 16px;
`;

export const FieldRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

export const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: ${(props) => props.$top || "0"};
`;

export const Button = styled.button`
  border: none;
  border-radius: 14px;
  padding: 12px 16px;
  background: ${(props) =>
    props.$variant === "secondary"
      ? "#fff"
      : props.$variant === "danger"
        ? props.theme.colors.error.default
        : props.theme.colors.primary.default};
  color: ${(props) =>
    props.$variant === "secondary" ? props.theme.colors.text.default : props.theme.colors.text.inverse};
  border: ${(props) => (props.$variant === "secondary" ? `1px solid ${props.theme.colors.border.default}` : "none")};
  cursor: pointer;
  font-size: 0.92rem;
  font-weight: 600;

  &:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }
`;

export const Notice = styled.div`
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid
    ${(props) => {
      if (props.$variant === "error") return props.theme.colors.error.default;
      if (props.$variant === "success") return props.theme.colors.success.default;
      if (props.$variant === "warning") return props.theme.colors.warning.default;
      return props.theme.colors.border.default;
    }};
  background:
    ${(props) => {
      if (props.$variant === "error") return props.theme.colors.error.default10;
      if (props.$variant === "success") return props.theme.colors.success.default10;
      if (props.$variant === "warning") return props.theme.colors.warning.default10;
      return props.theme.colors.secondary.default10;
    }};
  color:
    ${(props) => {
      if (props.$variant === "error") return props.theme.colors.error.default;
      if (props.$variant === "success") return props.theme.colors.success.default;
      if (props.$variant === "warning") return props.theme.colors.warning.default;
      return props.theme.colors.text.default;
    }};
  line-height: 1.6;
  white-space: pre-wrap;
`;

export const MetricList = styled.div`
  display: grid;
  gap: 12px;
`;

export const Metric = styled.div`
  padding: 14px 16px;
  border-radius: 16px;
  background: ${(props) => props.theme.colors.background.alternative};
  border: 1px solid ${(props) => props.theme.colors.border.default};
`;

export const MetricLabel = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: ${(props) => props.theme.colors.text.muted};
  margin-bottom: 6px;
`;

export const MetricValue = styled.div`
  font-size: 0.95rem;
  line-height: 1.5;
  color: ${(props) => props.theme.colors.text.default};
  word-break: break-word;
`;

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background:
    ${(props) => {
      if (props.$tone === "success") return props.theme.colors.success.default10;
      if (props.$tone === "warning") return props.theme.colors.warning.default10;
      if (props.$tone === "error") return props.theme.colors.error.default10;
      return props.theme.colors.secondary.default10;
    }};
  color:
    ${(props) => {
      if (props.$tone === "success") return props.theme.colors.success.default;
      if (props.$tone === "warning") return props.theme.colors.warning.default;
      if (props.$tone === "error") return props.theme.colors.error.default;
      return props.theme.colors.primary.default;
    }};
  font-size: 0.82rem;
  font-weight: 700;
`;

export const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${(props) => props.theme.colors.border.default};
  margin: 18px 0;
`;

export const Mono = styled.code`
  display: inline-block;
  font-family: ${(props) => props.theme.fonts.code};
  font-size: 0.82rem;
  word-break: break-all;
  white-space: pre-wrap;
  background: ${(props) => props.theme.colors.background.alternative};
  padding: 2px 6px;
  border-radius: 8px;
`;

export const Link = styled.a`
  color: ${(props) => props.theme.colors.primary.default};
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
`;

export const HelperText = styled.p`
  margin: 8px 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: ${(props) => props.theme.colors.text.muted};
`;

export const TimelineList = styled.div`
  display: grid;
  gap: 12px;
`;

export const StepFlow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;

  ${({ theme }) => theme.mediaQueries.small} {
    flex-direction: column;
  }
`;

export const StepCard = styled.div`
  min-width: 190px;
  flex: 1 1 0;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid
    ${(props) => {
      if (props.$tone === "success") return props.theme.colors.success.default;
      if (props.$tone === "warning") return props.theme.colors.warning.default;
      if (props.$tone === "error") return props.theme.colors.error.default;
      return props.theme.colors.border.default;
    }};
  background:
    ${(props) => {
      if (props.$tone === "success") return props.theme.colors.success.default10;
      if (props.$tone === "warning") return props.theme.colors.warning.default10;
      if (props.$tone === "error") return props.theme.colors.error.default10;
      return "#fff";
    }};
`;

export const StepHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
`;

export const StepNumber = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  font-weight: 700;
  background: ${(props) => props.theme.colors.primary.default};
  color: ${(props) => props.theme.colors.text.inverse};
`;

export const StepArrow = styled.div`
  align-self: center;
  color: ${(props) => props.theme.colors.text.muted};
  font-size: 1.3rem;
  font-weight: 700;

  ${({ theme }) => theme.mediaQueries.small} {
    transform: rotate(90deg);
  }
`;

export const TimelineItem = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid ${(props) => props.theme.colors.border.default};
  background: #fff;
`;

export const TimelineDot = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 4px;
  background:
    ${(props) => {
      if (props.$tone === "success") return props.theme.colors.success.default;
      if (props.$tone === "warning") return props.theme.colors.warning.default;
      if (props.$tone === "error") return props.theme.colors.error.default;
      return props.theme.colors.primary.default;
    }};
`;

export const TimelineContent = styled.div`
  flex: 1;
`;

export const TimelineTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 4px;
`;

export const TimelineText = styled.div`
  font-size: 0.88rem;
  line-height: 1.55;
  color: ${(props) => props.theme.colors.text.muted};
`;
