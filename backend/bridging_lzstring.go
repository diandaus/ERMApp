package main

import (
	"errors"
	"strings"
)

// ============================================================================
// LZ-STRING — decompressFromEncodedURIComponent, diporting persis dari
// implementasi PHP resmi (nullpunkt/lz-string-php) yang terbukti berhasil di
// production. Dibutuhkan karena field "response" VClaim/HFIS, setelah
// didekripsi AES-256-CBC, hasilnya BUKAN langsung JSON — masih terkompresi
// dengan format LZString (compressToEncodedURIComponent di sisi BPJS) dan
// harus didekompresi dulu sebelum bisa di-parse sebagai JSON.
// ============================================================================

const lzKeyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$"

type lzData struct {
	str      []rune
	index    int
	val      int
	position int
	end      bool
}

func lzGetNextValue(d *lzData) int {
	if d.index >= len(d.str) {
		d.end = true
		return 0
	}
	ch := d.str[d.index]
	d.index++
	return strings.IndexRune(lzKeyStrUriSafe, ch)
}

func lzReadBits(d *lzData, resetValue, exponent int) int {
	bits := 0
	maxPower := 1 << uint(exponent)
	power := 1
	for power != maxPower {
		resb := d.val & d.position
		d.position >>= 1
		if d.position == 0 {
			d.position = resetValue
			d.val = lzGetNextValue(d)
		}
		if resb > 0 {
			bits |= power
		}
		power <<= 1
	}
	return bits
}

// lzDecompressFromEncodedURIComponent adalah port dari
// LZString::decompressFromEncodedURIComponent (alfabet URI-safe, resetValue 32).
func lzDecompressFromEncodedURIComponent(input string) (string, error) {
	if input == "" {
		return "", nil
	}
	input = strings.ReplaceAll(input, " ", "+")

	const resetValue = 32
	d := &lzData{str: []rune(input)}
	d.val = lzGetNextValue(d)
	d.position = resetValue

	next := lzReadBits(d, resetValue, 2)
	if next < 0 || next > 1 {
		return "", errors.New("format LZString tidak valid")
	}
	exponent := 8
	if next == 1 {
		exponent = 16
	}
	bits := lzReadBits(d, resetValue, exponent)
	c := string(rune(bits))

	dictionary := []string{"", "", "", c}
	w := c
	var result strings.Builder
	result.WriteString(c)

	enlargeIn := 4
	numBits := 3

	for {
		if d.end {
			return "", errors.New("data LZString berakhir tidak wajar")
		}
		code := lzReadBits(d, resetValue, numBits)

		switch code {
		case 0:
			b := lzReadBits(d, resetValue, 8)
			code = len(dictionary)
			dictionary = append(dictionary, string(rune(b)))
			enlargeIn--
		case 1:
			b := lzReadBits(d, resetValue, 16)
			code = len(dictionary)
			dictionary = append(dictionary, string(rune(b)))
			enlargeIn--
		case 2:
			return result.String(), nil
		}

		if enlargeIn == 0 {
			enlargeIn = 1 << uint(numBits)
			numBits++
		}

		var entry string
		switch {
		case code >= 0 && code < len(dictionary):
			entry = dictionary[code]
		case code == len(dictionary):
			entry = w + string([]rune(w)[0])
		default:
			return "", errors.New("data LZString rusak")
		}

		result.WriteString(entry)
		dictionary = append(dictionary, w+string([]rune(entry)[0]))
		w = entry

		enlargeIn--
		if enlargeIn == 0 {
			enlargeIn = 1 << uint(numBits)
			numBits++
		}
	}
}
