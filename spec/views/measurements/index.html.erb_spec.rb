require 'rails_helper'

RSpec.describe "measurements/index", :type => :view do
  before(:each) do
    assign(:measurements, [
      Measurement.create!(
        :prefix => "Prefix",
        :data_portal_name => "Data Portal Name",
        :units_label => "Units Label",
        :units_label_short => "Units Label Short",
        :percent => false,
        :real => false,
        :notes => "MyText"
      ),
      Measurement.create!(
        :prefix => "Prefix",
        :data_portal_name => "Data Portal Name",
        :units_label => "Units Label",
        :units_label_short => "Units Label Short",
        :percent => false,
        :real => false,
        :notes => "MyText"
      )
    ])
  end

  it "renders a list of measurements" do
    render
    assert_select "tr>td", :text => "Prefix".to_s, :count => 2
    assert_select "tr>td", :text => "Data Portal Name".to_s, :count => 2
    assert_select "tr>td", :text => "Units Label".to_s, :count => 2
    assert_select "tr>td", :text => "Units Label Short".to_s, :count => 2
    assert_select "tr>td", :text => false.to_s, :count => 2
    assert_select "tr>td", :text => false.to_s, :count => 2
    assert_select "tr>td", :text => "MyText".to_s, :count => 2
  end
end
