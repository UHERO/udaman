require 'rails_helper'

RSpec.describe "units/index", type: :view do
  before(:each) do
    assign(:units, [
      Unit.create!(
        :short_label => "Short Label",
        :long_label => "Long Label"
      ),
      Unit.create!(
        :short_label => "Short Label",
        :long_label => "Long Label"
      )
    ])
  end

  it "renders a list of units" do
    render
    assert_select "tr>td", :text => "Short Label".to_s, :count => 2
    assert_select "tr>td", :text => "Long Label".to_s, :count => 2
  end
end
