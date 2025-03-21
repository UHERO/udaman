RSpec.describe Series, type: :model do
  # Helper method to find an existing series
  let(:existing_series) { Series.where(universe: "UHERO").first }

  describe "validations" do
    it "requires a name" do
      series = existing_series.dup
      series.name = nil
      expect(series).not_to be_valid
      expect(series.errors[:name]).to include("can't be blank")
    end

    it "requires unique name within universe" do
      series = existing_series.dup
      # No need to change anything - it should have the same name
      expect(series).not_to be_valid
      expect(series.errors[:name]).to include("has already been taken")
    end
  end

  describe "#parse_name" do
    it "correctly parses a standard series name" do
      parsed = existing_series.parse_name
      expect(parsed).to include(:prefix, :geo, :freq)
    end
  end
end
