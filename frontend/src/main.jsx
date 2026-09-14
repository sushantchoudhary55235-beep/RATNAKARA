import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LandingPage from './landing page cover/LandingPage.jsx'
import App from './App.jsx'

/*
  Minimal route separation (no react-router dependency):
    /        -> existing landing cover page
    /globe   -> existing Ratnakara application (App.jsx)

  The pathname is re-read whenever the route changes (popstate),
  so the landing button can swap views instantly via SPA
  navigation (no full page reload). Direct visits to /globe
  also work, since the route is read once on first render.
*/
const readRoute = () => window.location.pathname === '/globe'

function Root() {
  const [isGlobeRoute, setIsGlobeRoute] = useState(readRoute)

  /*
    STATIC SPLASH HANDOFF — index.html paints a branded splash
    from the first byte (slow networks see it instead of a blank
    page while the module graph loads). Fade it out once React
    mounts; the globe route's own boot overlay takes over from
    there.
  */
  useEffect(() => {
    const splash = document.getElementById('boot-splash')
    if (!splash) return undefined

    splash.classList.add('boot-hide')
    const timer = setTimeout(() => splash.remove(), 600)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onRouteChange = () => setIsGlobeRoute(readRoute())
    window.addEventListener('popstate', onRouteChange)

    return () => window.removeEventListener('popstate', onRouteChange)
  }, [])

  useEffect(() => {
    if (isGlobeRoute) {
      /* The landing page leaves the window scrolled; reset for the globe. */
      window.scrollTo(0, 0)
      return undefined
    }

    /*
      index.css sets body { overflow: hidden } for the globe app.
      The landing cover page needs normal window scrolling
      (window.scrollY drives its animation), so restore the
      default visible overflow — body must stay a non-scroll
      container for window scroll events to fire.
    */
    document.body.style.overflow = 'visible'

    return () => {
      document.body.style.overflow = ''
    }
  }, [isGlobeRoute])

  return isGlobeRoute ? <App /> : <LandingPage />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
