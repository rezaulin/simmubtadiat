package handlers

import (
	"encoding/json"
	"net/http"
)

// writeJSON encodes v as JSON and writes it to w.
// Unlike json.NewEncoder, it disables HTML escaping so characters like '
// (apostrophe) are written literally instead of as &#39;.
func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.Encode(v)
}
