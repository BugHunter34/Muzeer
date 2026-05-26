const Artist = require('../models/Artist');


const cleanBio = (bioHtml) => {
  if (!bioHtml) return '';
  return bioHtml.split('<a href')[0].trim();
};

exports.getArtistInfo = async (req, res) => {
  try {
    const artistName = req.query.name;
    
    if (!artistName) {
      return res.status(400).json({ error: 'Artist name is required' });
    }


    let artist = await Artist.findOne({ name: new RegExp(`^${artistName}$`, 'i') });

  
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isDataFresh = artist && artist.lastUpdated > sevenDaysAgo;


    if (artist && isDataFresh) {
      return res.status(200).json(artist);
    }

 
    const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
    if (!LASTFM_API_KEY) {
       console.warn("LASTFM_API_KEY is missing in .env");
       return res.status(500).json({ error: "Server API configuration missing" });
    }

    const lastFmUrl = `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json`;
    
    const response = await fetch(lastFmUrl);
    const data = await response.json();

    if (data.error || !data.artist) {

      return res.status(404).json({ error: 'Artist not found on external API' });
    }


    const apiArtist = data.artist;
    const bio = cleanBio(apiArtist.bio?.summary);
    

    const tags = apiArtist.tags?.tag?.map(t => t.name) || [];


    let imageUrl = '';
    if (apiArtist.image && apiArtist.image.length > 0) {
      const bestImage = apiArtist.image.find(img => img.size === 'extralarge') || apiArtist.image[apiArtist.image.length - 1];
      imageUrl = bestImage['#text'] || '';
    }

    if (artist) {
      
      artist.bio = bio;
      artist.imageUrl = imageUrl;
      artist.tags = tags;
      artist.lastUpdated = Date.now();
      await artist.save();
    } else {
      
      artist = new Artist({
        name: apiArtist.name || artistName, 
        bio,
        imageUrl,
        tags,
      });
      await artist.save();
    }

    
    res.status(200).json(artist);

  } catch (err) {
    console.error('Error fetching artist metadata:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};