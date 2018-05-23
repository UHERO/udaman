require 'rails_helper'

RSpec.describe "measurements/show", :type => :view do
  before(:each) do
    @measurement = assign(:measurement, Measurement.create!(
      :prefix => "Prefix",
      :data_portal_name => "Data Portal Name",
      :percent => false,
      :real => false,
      :notes => "MyText"
    ))
  end

  xit "renders attributes in <p>" do
    render
    expect(rendered).to match(/Prefix/)
    expect(rendered).to match(/Data Portal Name/)
    expect(rendered).to match(/false/)
    expect(rendered).to match(/false/)
    expect(rendered).to match(/MyText/)
  end
end
