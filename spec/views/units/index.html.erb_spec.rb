require 'rails_helper'

RSpec.describe "units/index", type: :view do
  before(:each) do
    assign(:units, [
      Unit.create!(
        :short_label => "Short Label",
        :long_label => "Long Label"
      ),
      Unit.create!(
        :short_label => "Short Label2",
        :long_label => "Long Label2"
      )
    ])
  end

  it "renders a list of units" do
    render
    assert_select "tr>td", :text => "Short Label".to_s, :count => 1
    assert_select "tr>td", :text => "Long Label".to_s, :count => 1
    assert_select "tr>td", :text => "Short Label2".to_s, :count => 1
    assert_select "tr>td", :text => "Long Label2".to_s, :count => 1
  end
end
