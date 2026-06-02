redirectIfAuthenticated();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  setText('loginError', '');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    console.log("Redirecting to dashboard...")
    window.location.replace('/dashboard.html');
  } catch (err) {
    setText('loginError', err.message);
  }
});
