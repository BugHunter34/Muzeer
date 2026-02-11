import { useState } from 'react'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Note: We point to port 3000 where Flask is running
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Server error')
      }

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Music Search</h1>
      
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type song name or URL..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="error">Error: {error}</div>}

      {result && (
        <div className="result">
          <h3>{result.title}</h3>
          <a href={result.webpage_url} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
          <br />
          {result.thumbnail && (
            <img src={result.thumbnail} alt="Thumbnail" />
          )}
        </div>
      )}
    </div>
  )
}

export default App