import add2CartLogo from '../assets/add2cart Logo/add2cart.png'

export default function Brand({ navigate }) {
  return <a className="brand" href="#home" onClick={() => navigate('home')} aria-label="Add2Cart home"><img className="brand-logo" src={add2CartLogo} alt="" /><span>Add2Cart</span></a>
}
