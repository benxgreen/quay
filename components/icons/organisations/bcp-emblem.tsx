/**
 * Pass `label` when the logo is the only content of a link or heading; leave it
 * out when it is decorative and the text beside it already names the page.
 */
const EmblemLogo = ({ label }: { label?: string }) => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: named with aria-label when `label` is passed, hidden otherwise
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 53 32"
		{...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
		focusable="false"
	>
		<path fill="#361E54" d="M0 0h52.222v31.706H0z"></path>
		<path
			fill="#00ADE2"
			d="M0 31.706v-6.034s5.156-.987 7.24.987c1.208-.768 3.292-1.865 5.377-1.865 1.316 0 3.73 1.207 3.95 2.743 0 0 8.227-9.984 23.806-5.595 0 0 4.498-5.925 11.849-8.119v17.993z"
		></path>
		<circle cx="13.714" cy="24.465" r="1.755" fill="#fff"></circle>
		<circle cx="26.879" cy="20.625" r="1.755" fill="#fff"></circle>
		<circle cx="42.896" cy="18.321" r="1.755" fill="#fff"></circle>
		<circle cx="37.411" cy="21.503" r="0.987" fill="#fff"></circle>
		<circle cx="36.424" cy="19.2" r="0.878" fill="#fff"></circle>
		<circle cx="35.326" cy="16.895" r="0.768" fill="#fff"></circle>
		<circle cx="34.339" cy="14.701" r="0.768" fill="#fff"></circle>
		<circle cx="33.461" cy="12.507" r="0.658" fill="#fff"></circle>
		<circle cx="32.584" cy="10.532" r="0.549" fill="#fff"></circle>
		<circle cx="31.706" cy="8.557" r="0.549" fill="#fff"></circle>
		<circle cx="30.938" cy="6.802" r="0.439" fill="#fff"></circle>
		<circle cx="30.17" cy="5.157" r="0.329" fill="#fff"></circle>
		<circle cx="29.622" cy="3.73" r="0.219" fill="#fff"></circle>
		<circle cx="40.593" cy="22.052" r="0.987" fill="#fff"></circle>
		<circle cx="39.495" cy="19.638" r="0.878" fill="#fff"></circle>
		<circle cx="38.508" cy="17.334" r="0.768" fill="#fff"></circle>
		<circle cx="37.521" cy="15.249" r="0.768" fill="#fff"></circle>
		<circle cx="36.533" cy="13.056" r="0.658" fill="#fff"></circle>
		<circle cx="35.656" cy="10.971" r="0.549" fill="#fff"></circle>
		<circle cx="34.888" cy="8.996" r="0.549" fill="#fff"></circle>
		<circle cx="34.01" cy="7.241" r="0.439" fill="#fff"></circle>
		<circle cx="33.352" cy="5.705" r="0.329" fill="#fff"></circle>
		<circle cx="34.339" cy="21.284" r="0.987" fill="#fff"></circle>
		<circle cx="33.351" cy="18.98" r="0.878" fill="#fff"></circle>
		<circle cx="32.364" cy="16.676" r="0.768" fill="#fff"></circle>
		<circle cx="31.377" cy="14.481" r="0.768" fill="#fff"></circle>
		<circle cx="30.39" cy="12.287" r="0.658" fill="#fff"></circle>
		<circle cx="29.511" cy="10.312" r="0.549" fill="#fff"></circle>
		<circle cx="28.634" cy="8.338" r="0.549" fill="#fff"></circle>
		<circle cx="27.866" cy="6.582" r="0.439" fill="#fff"></circle>
		<circle cx="27.207" cy="4.937" r="0.329" fill="#fff"></circle>
		<circle cx="31.377" cy="21.284" r="0.987" fill="#fff"></circle>
		<circle cx="30.39" cy="18.98" r="0.878" fill="#fff"></circle>
		<circle cx="29.402" cy="16.676" r="0.768" fill="#fff"></circle>
		<circle cx="28.415" cy="14.482" r="0.768" fill="#fff"></circle>
		<circle cx="27.427" cy="12.287" r="0.658" fill="#fff"></circle>
		<circle cx="26.549" cy="10.203" r="0.549" fill="#fff"></circle>
		<circle cx="23.478" cy="23.149" r="0.987" fill="#fff"></circle>
		<circle cx="22.381" cy="20.735" r="0.878" fill="#fff"></circle>
		<circle cx="21.394" cy="18.431" r="0.768" fill="#fff"></circle>
		<circle cx="20.406" cy="16.347" r="0.768" fill="#fff"></circle>
		<circle cx="19.419" cy="14.152" r="0.658" fill="#fff"></circle>
		<circle cx="18.541" cy="12.068" r="0.549" fill="#fff"></circle>
		<circle cx="17.773" cy="10.203" r="0.549" fill="#fff"></circle>
		<circle cx="17.005" cy="8.338" r="0.439" fill="#fff"></circle>
		<circle cx="16.237" cy="6.802" r="0.329" fill="#fff"></circle>
		<circle cx="21.064" cy="24.355" r="0.987" fill="#fff"></circle>
		<circle cx="19.967" cy="22.051" r="0.878" fill="#fff"></circle>
		<circle cx="18.98" cy="19.638" r="0.768" fill="#fff"></circle>
		<circle cx="17.992" cy="17.553" r="0.768" fill="#fff"></circle>
		<circle cx="17.005" cy="15.359" r="0.658" fill="#fff"></circle>
		<circle cx="16.127" cy="13.274" r="0.549" fill="#fff"></circle>
		<circle cx="15.359" cy="11.409" r="0.549" fill="#fff"></circle>
		<circle cx="14.591" cy="9.544" r="0.439" fill="#fff"></circle>
		<circle cx="13.823" cy="8.008" r="0.329" fill="#fff"></circle>
		<circle cx="18.761" cy="25.891" r="0.987" fill="#fff"></circle>
		<circle cx="17.773" cy="23.478" r="0.878" fill="#fff"></circle>
		<circle cx="16.786" cy="21.174" r="0.768" fill="#fff"></circle>
		<circle cx="15.799" cy="19.09" r="0.768" fill="#fff"></circle>
		<circle cx="14.811" cy="16.895" r="0.658" fill="#fff"></circle>
		<circle cx="13.933" cy="14.811" r="0.549" fill="#fff"></circle>
		<circle cx="13.056" cy="12.946" r="0.549" fill="#fff"></circle>
		<circle cx="12.288" cy="11.081" r="0.439" fill="#fff"></circle>
		<circle cx="11.63" cy="9.545" r="0.329" fill="#fff"></circle>
		<circle cx="10.971" cy="8.009" r="0.219" fill="#fff"></circle>
		<circle cx="16.676" cy="27.317" r="0.987" fill="#fff"></circle>
		<circle cx="13.933" cy="21.284" r="0.768" fill="#fff"></circle>
		<circle cx="12.946" cy="19.09" r="0.768" fill="#fff"></circle>
		<circle cx="12.068" cy="16.895" r="0.658" fill="#fff"></circle>
		<circle cx="11.19" cy="14.811" r="0.549" fill="#fff"></circle>
		<circle cx="10.313" cy="12.946" r="0.549" fill="#fff"></circle>
		<circle cx="9.545" cy="11.19" r="0.439" fill="#fff"></circle>
		<circle cx="8.777" cy="9.545" r="0.329" fill="#fff"></circle>
		<circle cx="8.228" cy="8.118" r="0.219" fill="#fff"></circle>
		<circle cx="24.026" cy="17.554" r="0.768" fill="#fff"></circle>
		<circle cx="22.929" cy="15.469" r="0.768" fill="#fff"></circle>
		<circle cx="22.051" cy="13.275" r="0.658" fill="#fff"></circle>
		<circle cx="21.174" cy="11.19" r="0.549" fill="#fff"></circle>
		<circle cx="20.296" cy="9.216" r="0.549" fill="#fff"></circle>
		<circle cx="19.528" cy="7.46" r="0.439" fill="#fff"></circle>
		<circle cx="18.76" cy="5.815" r="0.329" fill="#fff"></circle>
		<circle cx="18.212" cy="4.388" r="0.219" fill="#fff"></circle>
		<circle cx="26.549" cy="16.895" r="0.768" fill="#fff"></circle>
		<circle cx="25.562" cy="14.701" r="0.768" fill="#fff"></circle>
		<circle cx="24.575" cy="12.507" r="0.658" fill="#fff"></circle>
		<circle cx="23.697" cy="10.532" r="0.549" fill="#fff"></circle>
		<circle cx="11.08" cy="21.832" r="0.878" fill="#fff"></circle>
		<circle cx="10.093" cy="19.528" r="0.768" fill="#fff"></circle>
		<circle cx="9.106" cy="17.334" r="0.768" fill="#fff"></circle>
		<circle cx="8.119" cy="15.14" r="0.658" fill="#fff"></circle>
		<circle cx="9.545" cy="24.904" r="0.987" fill="#fff"></circle>
		<circle cx="8.557" cy="22.49" r="0.878" fill="#fff"></circle>
		<circle cx="7.57" cy="20.186" r="0.768" fill="#fff"></circle>
		<circle cx="6.583" cy="17.993" r="0.768" fill="#fff"></circle>
		<circle cx="7.351" cy="26.44" r="0.987" fill="#fff"></circle>
		<circle cx="6.253" cy="24.027" r="0.878" fill="#fff"></circle>
		<circle cx="5.266" cy="21.722" r="0.768" fill="#fff"></circle>
		<circle cx="4.278" cy="19.528" r="0.768" fill="#fff"></circle>
		<circle cx="3.949" cy="25.562" r="0.987" fill="#fff"></circle>
		<circle cx="2.962" cy="23.258" r="0.878" fill="#fff"></circle>
		<circle cx="46.956" cy="16.237" r="0.878" fill="#fff"></circle>
		<circle cx="45.968" cy="13.933" r="0.768" fill="#fff"></circle>
		<circle cx="44.981" cy="11.848" r="0.768" fill="#fff"></circle>
		<circle cx="43.993" cy="9.654" r="0.658" fill="#fff"></circle>
		<circle cx="43.445" cy="14.92" r="0.768" fill="#fff"></circle>
		<circle cx="42.457" cy="12.836" r="0.768" fill="#fff"></circle>
		<circle cx="41.58" cy="10.641" r="0.658" fill="#fff"></circle>
		<circle cx="40.593" cy="8.557" r="0.549" fill="#fff"></circle>
		<circle cx="49.369" cy="14.81" r="0.768" fill="#fff"></circle>
		<circle cx="48.382" cy="12.617" r="0.768" fill="#fff"></circle>
		<circle cx="40.592" cy="15.359" r="0.768" fill="#fff"></circle>
		<circle cx="39.605" cy="13.275" r="0.768" fill="#fff"></circle>
		<circle cx="38.617" cy="11.081" r="0.658" fill="#fff"></circle>
	</svg>
);

export default EmblemLogo;
