package models

import "testing"

// SemesterDariKuartal: K1,K2 → Smt1; K3,K4 → Smt2.
func TestSemesterDariKuartal(t *testing.T) {
	cases := []struct {
		kuartal int
		want    int
	}{
		{1, 1},
		{2, 1},
		{3, 2},
		{4, 2},
	}
	for _, c := range cases {
		if got := SemesterDariKuartal(c.kuartal); got != c.want {
			t.Errorf("SemesterDariKuartal(%d) = %d, want %d", c.kuartal, got, c.want)
		}
	}
}
