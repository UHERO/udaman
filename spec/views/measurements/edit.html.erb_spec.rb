require 'rails_helper'

RSpec.describe "measurements/edit", :type => :view do
  before(:each) do
    @measurement = assign(:measurement, Measurement.create!(
      :prefix => "MyString",
      :data_portal_name => "MyString",
      :units_label => "MyString",
      :units_label_short => "MyString",
      :percent => false,
      :real => false,
      :notes => "MyText"
    ))
  end

  it "renders the edit measurement form" do
    render

    assert_select "form[action=?][method=?]", measurement_path(@measurement), "post" do

      assert_select "input#measurement_prefix[name=?]", "measurement[prefix]"

      assert_select "input#measurement_data_portal_name[name=?]", "measurement[data_portal_name]"

      assert_select "input#measurement_units_label[name=?]", "measurement[units_label]"

      assert_select "input#measurement_units_label_short[name=?]", "measurement[units_label_short]"

      assert_select "input#measurement_percent[name=?]", "measurement[percent]"

      assert_select "input#measurement_real[name=?]", "measurement[real]"

      assert_select "textarea#measurement_notes[name=?]", "measurement[notes]"
    end
  end
end
