import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "./api";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);


  async function handleLogin(e) {

    e.preventDefault();

    setError("");
    setLoading(true);

    try {

      const data = await loginUser(
        email,
        password
      );

            // Go to dashboard
      navigate("/dashboard");

    } catch (err) {

      console.error(
        "Login error:",
        err
      );

      setError(
        err.response?.data?.detail ||
        "Invalid email or password"
      );

    } finally {

      setLoading(false);

    }
  }


  return (

    <div className="auth-container">

      <div className="auth-card">

        <h1>
          Predictive APM
        </h1>

        <p>
          Login to your monitoring dashboard
        </p>


        <form onSubmit={handleLogin}>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />


          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
          />


          {error && (

            <div className="auth-error">
              {error}
            </div>

          )}


          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Logging in..."
              : "Login"}

          </button>

        </form>


        <p>

          Don't have an account?{" "}

          <button
            type="button"
            onClick={() =>
              navigate("/register")
            }
          >
            Register
          </button>

        </p>

      </div>

    </div>

  );
}


export default Login;