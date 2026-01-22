type BuildFlightsArgs = {
  fromLabelOrIata: string;
  toLabelOrIata: string;
  departDate?: string;
  returnDate?: string;
};

export const buildGoogleFlightsUrl = ({
  fromLabelOrIata,
  toLabelOrIata,
  departDate,
  returnDate,
}: BuildFlightsArgs) => {
  const dateParts = [departDate, returnDate].filter(Boolean).join(" ");
  const query = `Flights from ${fromLabelOrIata} to ${toLabelOrIata}${
    dateParts ? ` ${dateParts}` : ""
  }`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
};
