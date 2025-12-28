export const metadata = {
  title: 'Do My Bets Suck?',
  description: 'Test your NFL betting hypotheses against historical data',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </head>
      <body style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 0,
        padding: 0,
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  )
}
