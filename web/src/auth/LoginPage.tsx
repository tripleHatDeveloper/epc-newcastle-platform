import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit() {
    const result = await login(email, password);
    if (!result.token) {
      setError("That email or password is incorrect.");
      return;
    }
    localStorage.setItem("epc_token", result.token);
    navigate("/admin");
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logos">
          {/* TODO: replace with the real Newcastle City Council and Northumbria
              University logo files — see README "Assets to add before launch" */}
          <img src="/assets/newcastle-city-council-logo.png" alt="Newcastle City Council" />
          <img src="/assets/northumbria-university-logo.png" alt="Northumbria University" />
        </div>

        <h1>Sign in</h1>
        <p>Newcastle EPC building explorer</p>

        <label>Email</label>
        <input
          type="email"
          placeholder="name@northumbria.ac.uk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="field-error">{error}</p>}

        <button onClick={submit}>Sign in</button>
        <p className="login-note">Your role determines what you can view and edit.</p>
      </div>
    </div>
  );
}
