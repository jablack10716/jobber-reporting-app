import { Page } from "@jobber/components/Page";
import { Text } from "@jobber/components/Text";
import { Button } from "@jobber/components/Button";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  return (
    <Page title="👋  Welcome to Jobber Reporting App" width="fill">
      <div style={{ maxWidth: "854px" }}>
        <Text size="large">
          Welcome to your Jobber Reporting Dashboard! This app provides detailed
          reports and analytics for your plumbing business.
        </Text>
        <br />
        <Text size="large">
          Click the button below to access your reports and view detailed analytics
          for your team and business performance.
        </Text>
      </div>
      <Button 
        label="Go to Reports" 
        onClick={() => {
          console.log('Reports button clicked at', new Date().toISOString());
          navigate('/reports');
        }} 
      />
    </Page>
  );
}

export default Home;
