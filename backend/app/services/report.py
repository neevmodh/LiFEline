"""One-page monthly impact report as a PDF. Core fonts only, so currency is written "Rs."."""

from dataclasses import dataclass

from fpdf import FPDF


@dataclass(frozen=True)
class ReportData:
    name: str
    month_label: str
    district: str
    discom: str
    kwh: float | None
    bill_rs: float | None
    kg_co2: float | None
    baseline_kwh: float
    change_pct: float | None
    actions: int
    action_co2_kg: float
    action_kwh: float
    points: int


def _rs(n: float) -> str:
    return f"Rs. {n:,.0f}"


def render_report(d: ReportData) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(False)
    pdf.add_page()
    pdf.set_fill_color(10, 129, 87)
    pdf.rect(0, 0, 210, 34, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_xy(15, 10)
    pdf.cell(0, 8, "Nidhi monthly impact report")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_xy(15, 21)
    pdf.cell(0, 6, f"{d.month_label}  |  {d.name}  |  {d.district}")

    pdf.set_text_color(15, 42, 30)
    y = 46

    def row(label: str, value: str, note: str = "") -> None:
        nonlocal y
        pdf.set_xy(15, y)
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(88, 112, 100)
        pdf.cell(80, 8, label)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(15, 42, 30)
        pdf.cell(60, 8, value)
        if note:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(88, 112, 100)
            pdf.cell(0, 8, note)
        y += 11

    pdf.set_font("Helvetica", "B", 13)
    pdf.set_xy(15, y)
    pdf.cell(0, 8, "Your electricity")
    y += 12
    if d.kwh is None:
        row("Units this month", "not logged yet", "Add your bill to see this section.")
    else:
        row("Units used", f"{d.kwh:,.0f} kWh", f"your usual month: {d.baseline_kwh:,.0f} kWh")
        if d.change_pct is not None:
            row("Compared with your usual", f"{d.change_pct:+.1f}%")
        row(f"Bill ({d.discom})", _rs(d.bill_rs or 0), "calculated from the company's own slabs")
        row("Carbon from electricity", f"{d.kg_co2:,.1f} kg CO2")

    y += 6
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_xy(15, y)
    pdf.cell(0, 8, "Your green actions")
    y += 12
    row("Actions counted", str(d.actions))
    row("Carbon avoided", f"{d.action_co2_kg:,.1f} kg CO2")
    row("Electricity saved", f"{d.action_kwh:,.1f} kWh")
    row("Points earned", str(d.points))

    pdf.set_xy(15, 262)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(88, 112, 100)
    pdf.multi_cell(180, 4, "Figures come from the bill you entered and the actions you logged. Emission factors and "
                   "tariffs are listed on the How we calculate page of Nidhi. Gujarat Energy Development Agency - Mission LiFE.")
    return bytes(pdf.output())
