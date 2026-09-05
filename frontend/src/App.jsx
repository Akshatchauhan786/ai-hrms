import { useEffect, useState } from "react";
import api from "./api/api";

function App() {
  const [status, setStatus] = useState("Checking API...");

  useEffect(() => {
    api
      .get("/health")
      .then((response) => {
        setStatus(response.data.message);
      })
      .catch(() => {
        setStatus("API connection failed");
      });
  }, []);

  return (
    <div>
      <h1>AI HRMS</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;