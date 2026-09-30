// JSON helpers for the detection package.
//
// The values we need out of the official app's files are all flat strings at the
// top level, so a tiny scanner is used instead of encoding/json: one of those
// files (resources/runtime/primary-runtime/runtime.json) is only read for one
// field, and a decoder would drag in the whole document for no benefit. The
// scanner is exercised directly by detect_test.go.
package officialdetect

import (
	"strings"
	"unicode"
)

// jsonStringField returns the value of a top-level string field. It returns ""
// when the document does not contain that field as a string.
func jsonStringField(document, field string) string {
	key := `"` + field + `"`
	index := strings.Index(document, key)
	if index < 0 {
		return ""
	}
	rest := document[index+len(key):]
	colon := strings.IndexByte(rest, ':')
	if colon < 0 {
		return ""
	}
	rest = strings.TrimLeftFunc(rest[colon+1:], unicode.IsSpace)
	if len(rest) == 0 || rest[0] != '"' {
		return ""
	}
	rest = rest[1:]
	var b strings.Builder
	for i := 0; i < len(rest); i++ {
		switch rest[i] {
		case '\\':
			if i+1 >= len(rest) {
				return b.String()
			}
			i++
			switch rest[i] {
			case 'n':
				b.WriteByte('\n')
			case 't':
				b.WriteByte('\t')
			case 'r':
				b.WriteByte('\r')
			default:
				b.WriteByte(rest[i])
			}
		case '"':
			return b.String()
		default:
			b.WriteByte(rest[i])
		}
	}
	return b.String()
}
