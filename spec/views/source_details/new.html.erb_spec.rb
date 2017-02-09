require 'rails_helper'

RSpec.describe "source_details/new", type: :view do
  before(:each) do
    assign(:source_detail, SourceDetail.new(
      :description => "MyText"
    ))
  end

  it "renders new source_detail form" do
    render

    assert_select "form[action=?][method=?]", source_details_path, "post" do

      assert_select "textarea#source_detail_description[name=?]", "source_detail[description]"
    end
  end
end
