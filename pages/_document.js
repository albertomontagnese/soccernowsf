import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=2" />
        <link rel="icon" type="image/png" sizes="180x180" href="/favicon.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png?v=2" />
        <meta name="theme-color" content="#020617" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
