require 'rails_helper'

RSpec.describe "units/show", type: :view do
  before(:each) do
    @unit = assign(:unit, Unit.create!(
      :short_label => "Short Label",
      :long_label => "Long Label"
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Short Label/)
    expect(rendered).to match(/Long Label/)
  end
end
